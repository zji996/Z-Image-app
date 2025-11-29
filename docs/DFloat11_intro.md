# DFloat11（DF11）原理速记

## 1. 它在干什么？

**目标：**  
在**不改变数值、不改推理代码**的前提下，把 BF16 权重从 16 bit 压成约 **11 bit/权重** 的可逆格式，并在 GPU 上实时还原回 **原始的 BF16 位串**。

> 推理结果（logits、token 输出、生成图像等）与原始 BF16 完全 bit-exact 一致。

---

## 2. 核心观察：只动 exponent 就够了

BF16 结构（共 16 bit）：

- sign：1 bit  
- exponent：8 bit  
- mantissa：7 bit  

对大模型权重做统计后发现：

- sign、mantissa 接近满熵 → **几乎压不动**
- exponent 熵大约只有 ~2.6 bit（远小于 8 bit）  
  → **有很大压缩空间**

因此 DF11 选择：

- **sign + mantissa：原样存成 1 个字节（无损、无编码）**
- **exponent：单独抽出来，用 Huffman 编码压缩**

平均下来：1（sign）+7（mantissa）+2.6（编码后的 exponent）≈ 10.6 bit  
再加上一点元数据，整体约等于 **11 bit / 权重**。

---

## 3. DF11 的存储格式

对一个 BF16 权重数组 `W`：

1. **拆位：**
   ```text
   raw      = BF16 16 bit
   sign     = raw >> 15
   exponent = (raw >> 7) & 0xFF
   mantissa = raw & 0x7F
````

2. **固定 1 字节存 sign+mantissa：**

   ```text
   packed_sm = (sign << 7) | mantissa  // 高 1 bit 是 sign，低 7 bit 是 mantissa
   PackedSignMantissa[] = packed_sm 的数组，长度 = 权重个数
   ```

3. **只压 exponent：**

   * 收集所有 exponent，统计频率
   * 基于频率构造 Huffman 树，给每个 exponent 一个变长 0/1 串
   * 把所有 exponent 的码字串起来 → bitstream → 打包成字节数组

   得到：

   ```text
   EncodedExponent: 对 exponent 的 Huffman bitstream
   ```

4. **解码辅助结构：**

   为了在 GPU 上高效解码变长码，DF11预计算：

   * **多级 LUT（层次化查找表）**：
     把 Huffman 树按高度 8 分段，每段生成一个 256 项的小查表：

     * 输入：8 bit 前缀
     * 输出：

       * 要么是最终 exponent 值
       * 要么是“指向下一层 LUT 的标签”（用 240–255 等未使用 exponent 值充当）

   * **CodeLengths[exponent]**：存每个 exponent 的码长（bit 数）

   * **Gaps**：每个 GPU 线程应从该字节片段的第几个 bit 开始解码（避免跨线程时落在 code 中间）

   * **BlockOutputPos**：每个 block 解出来的 exponent 在全局输出数组里的起始 index

---

## 4. “解压”过程：本质是查找 + 位拼装

在推理时，解压过程分两步（在 GPU 上完成）：

### 4.1 只解 exponent，数一数每线程有多少个元素

每个线程：

* 从 `Gaps` 给定的 bit 偏移开始
* 循环：

  1. 一次从 `EncodedExponent` 中读取若干字节到寄存器（例如 4 字节）
  2. 用多级 LUT 解出当前 exponent（纯查表，无浮点）
  3. 用 `CodeLengths[exponent]` 决定向前移动多少 bit
  4. `NumElements[thread]++`

然后 block 内做一次 prefix-sum：得到每个线程在全局输出中的起始位置 `ThreadOutputPos[thread]`。

### 4.2 再解 exponent，一边解一边还原 BF16

再跑一遍类似的循环，这次：

对每个解出来的 exponent：

```text
byte     = PackedSignMantissa[ThreadOutputPos[thread]]
sign     = byte >> 7
mantissa = byte & 0x7F

bf16 = (sign << 15) | (exponent << 7) | mantissa
Outputs[ThreadOutputPos[thread]] = bf16
ThreadOutputPos[thread]++
```

**关键点：**

* **没有任何数值计算**（没有乘、加、scale 等）
* “解压”只是：

  * 从 bitstream 解出 exponent（通过查 LUT）
  * 和原样保存的 sign、mantissa 做简单位拼装

> 所以说：**DF11 的“解压”从数值角度其实不解码，只是查找 + 拼装原始 BF16 位串。**

---

## 5. 推理时如何使用 DF11 模型？

整体流程：

1. **离线预处理一次：**

   * 从原 BF16 checkpoint 中提取权重
   * 统计 exponent 分布 → 构建 Huffman 树 → 生成 LUT、CodeLengths
   * 生成 PackedSignMantissa、EncodedExponent、Gaps、BlockOutputPos
   * 保存为 DF11 模型（原 BF16 可以扔）

2. **上线：**

   * 将 DF11 模型完整载入 GPU 显存（比原 BF16 小约 30%）
   * 推理时对每个 transformer block：

     * 调用 DF11 kernel 解出该 block 所需权重的 BF16 数组
     * 用现有 BF16 GEMM/Attention kernel 正常计算
     * 用完后丢弃临时 BF16，只保留 DF11 版本常驻显存

---

## 6. 和传统量化的区别

| 特性   | DFloat11                             | INT8/INT4 等量化                 |
| ---- | ------------------------------------ | ----------------------------- |
| 精度   | 完全 bit-exact，无任何数值误差                 | 有量化误差，可能引起行为变化                |
| 算子改动 | 不需要改 matmul/attention，还是 BF16 kernel | 需要特定的 INT8/INT4 kernel，或反量化操作 |
| 压缩率  | ~11 bit / weight（约 0.69× BF16 体积）    | 更高（8/4/2 bit），但要权衡精度和稳定性      |
| 计算开销 | 多一点“查表+位运算”解压开销                      | 量化/反量化开销 + 特殊 kernel          |
| 适用场景 | 要求行为完全一致（合规/回溯/对比实验）                 | 可以接受近似、追求更高压缩/吞吐的场景           |

---

## 7. 一句话描述给 AI 听

> **DFloat11 是一种专门针对 BF16 权重的无损压缩格式：
> 把 BF16 的 sign+mantissa 原样装进 1 字节，只对 exponent 做熵编码存成 bitstream；
> 推理时通过查表把 exponent 解回 8 bit，再和原 sign+mantissa 拼装成原始 BF16，
> 从而在几乎不改推理代码的情况下，把模型体积从 16 bit 压到约 11 bit。**

---

## 8. 在本仓库里的踩坑与实践记录

下面是把 Z-Image Turbo 接入 DF11 时踩过的坑和最终的推荐操作流程。

### 8.1 模型大小 & OOM 认知

- Z-Image Turbo 的 diffusers 版 transformer 约 **6.15B 参数**，整个 pipeline 约 **10.26B 参数**（含 text_encoder、VAE 等）。
- 以 BF16 计，光权重就要 ≈ **19.1 GiB 显存**，单卡 20GB 几乎塞满；
  Celery worker 在执行 `pipe.to("cuda")` 时，经常因为再申请几十 MiB 显存而 OOM。
- 结论：只靠普通的 `torch_dtype=torch.bfloat16` 和 `pipe.to("cuda")` 在 20GB 卡上跑 full Z-Image 非常吃紧，需要 DF11 / CPU offload 等手段。

### 8.2 单线程 DF11 压缩脚本

文件：`scripts/compress_z_image_dfloat11.py`

- 主要职责：对 **某个组件** 的 BF16 权重做 DF11 压缩并写到指定目录。
- 支持的组件（`--component`）：
  - `transformer`（默认）：`pipe.transformer`，占用最大。
  - `text_encoder`：`pipe.text_encoder`（Qwen3-XXB）。
  - `vae`：`pipe.vae`（如有需要也能压缩）。
- 自动构建 `pattern_dict`：
  - 遍历目标模块下所有 `nn.Linear` / `nn.Embedding`，
    把它们的 **完整 module 名** 作为 regex（精确匹配），value 为空元组 `()`，
    交给 DF11 的 `compress_model`，等价于“把每个 Linear/Embedding 当作一个独立 block 压缩”。
- 典型调用：
  ```bash
  # 压缩 transformer，单文件输出
  uv run --project apps/worker python scripts/compress_z_image_dfloat11.py \
    --component transformer \
    --model-path models/z-image-turbo \
    --save-path models/z-image-turbo-df11-golden \
    --save-single-file
  ```

踩过的点：

- 一开始只压 transformer，text_encoder 仍然用 BF16，显存还是偏高；
  后面把 `--component` 做成可切换，支持对 text_encoder / vae 分别压缩。
- 如果传 `--save-single-file`，会得到一个 `model.safetensors`+`config.json`，
  更适合在仓库里的 `models/z-image-xxx-df11` 下面做备份或对比。

### 8.3 多进程 DF11 压缩（CPU 并行）

文件：`scripts/compress_z_image_dfloat11_parallel.py`

目标：

- 单线程压整个 6B+ 模型耗时较长，想利用多核 CPU 并行压缩。
- 官方 FLUX.1 示例是“一个进程 + `block_range`”，我们这边实现了一个 **多进程协调器**：
  - 入口脚本负责计算总 block 数 → 拆成多个 `(start, end]` 区间；
  - 每个区间启动一个独立 Python 进程，调用 `compress_z_image_dfloat11`，只压自己负责的 block。

关键参数：

- `--blocks-per-task`: 每个 worker 进程负责的 block 数（例如 16）。
- `--max-workers`: 同时运行的进程数（例如 3–4，视内存情况调整）。
- `--save-single-file`:
  - 若不指定：所有 worker 直接在 `--save-path` 下写 `.safetensors` 分片 + 一个 `config.json`；
  - 若指定：worker 写到 `--save-path/_df11_shards/`，
    结束后由入口进程合并所有分片为一个 `model.safetensors`，复制 `config.json` 到最终目录。
- `--no-check-correctness`:
  - 关掉 DF11 自带的 GPU correctness check（会 `device='cuda:0'` 跑一遍解码），
    提高速度并显著降低显存占用。
- `--component`:
  - 显式指定要压哪一块：`transformer` / `text_encoder` / `vae`。
  - 并行入口会把这个参数原样传给单进程脚本，避免“路径指向 text_encoder 目录但实际压的是 transformer”这类混乱。

典型调用（多进程 + 单文件输出）：

```bash
uv run --project apps/worker python -m scripts.compress_z_image_dfloat11_parallel \
  --model-path models/z-image-turbo \
  --save-path models/z-image-turbo-df11-fast/transformer \
  --blocks-per-task 16 \
  --max-workers 3 \
  --save-single-file \
  --no-check-correctness
```

踩过的点：

- **每个 worker 都会加载一份完整模型**：
  - 这是 DF11 官方 `compress_model` 的限制，我们在不修改三方库的前提下无法做“共享权重”。
  - 实际上 CPU 内存占用近似：`模型大小 × max_workers`。
- correctness check 会使用 CUDA：
  - 多进程同时开 correctness check 很容易 **CUDA OOM**。
  - 现在脚本逻辑：如果没有加 `--no-check-correctness` 且 `max-workers>1`，会自动打印提示并强制 `max-workers=1`，退化为“单进程安全模式”。
- GIL 问题：
  - 脚本采用的是 **多进程** (`subprocess.Popen`)，每个进程有自己的 GIL，
    所以不会被单进程 GIL 限制 CPU 利用率。

推荐实践：

- 生成一份 “golden” DF11（单进程 + correctness check），用于之后对比：  
  （以 transformer 为例）
  ```bash
  uv run --project apps/worker python scripts/compress_z_image_dfloat11.py \
    --component transformer \
    --model-path models/z-image-turbo \
    --save-path models/z-image-turbo-df11-golden \
    --save-single-file
  ```
- 快速多进程版本关闭 correctness check，只追求速度：
  ```bash
  uv run --project apps/worker python -m scripts.compress_z_image_dfloat11_parallel \
    --component transformer \
    --model-path models/z-image-turbo \
    --save-path models/z-image-turbo-df11-fast/transformer \
    --blocks-per-task 16 \
    --max-workers 3 \
    --save-single-file \
    --no-check-correctness
  ```

- 同样方式为 text_encoder 压一份 golden：
  ```bash
  uv run --project apps/worker python scripts/compress_z_image_dfloat11.py \
    --component text_encoder \
    --model-path models/z-image-turbo \
    --save-path models/z-image-turbo-text-encoder-df11/text_encoder \
    --save-single-file
  ```

- 如需加速 text_encoder 压缩，可以再跑一份并行版本（同样关闭 correctness check，仅追求速度）：
  ```bash
  uv run --project apps/worker python -m scripts.compress_z_image_dfloat11_parallel \
    --component text_encoder \
    --model-path models/z-image-turbo \
    --save-path models/z-image-turbo-text-encoder-df11-fast/text_encoder \
    --blocks-per-task 16 \
    --max-workers 3 \
    --save-single-file \
    --no-check-correctness
  ```

### 8.4 单线程 vs 多线程 DF11 模型一致性校验

文件：`scripts/compare_safetensors_state_dicts.py`

用途：

- 检查两份 `.safetensors`（例如“单线程 DF11”和“多进程 DF11”）的 state_dict 是否 **逐元素完全相等**。

使用示例：

```bash
uv run --project apps/worker python -m scripts.compare_safetensors_state_dicts \
  --a models/z-image-turbo-df11-golden/model.safetensors \
  --b models/z-image-turbo-df11-fast/transformer/model.safetensors
```

检查项：

- 两边的 key 集合是否完全一致；
- 每个 key 对应 tensor 的 shape / dtype 是否一致；
- `(ta == tb).all()` 是否为 True —— 任意一个 key 不等都会直接报错说明。

实测：

- 在当前仓库里，用上述脚本对比单线程 DF11 与多进程 DF11 的 transformer 结果，得到：

  ```text
  [DF11] The two safetensors files are exactly identical.
  ```

### 8.5 推理时使用 DF11-only 模式

文件：`libs/py_core/z_image_pipeline.py`

- 运行时通过 `get_zimage_pipeline()` 构建统一的 Z-Image pipeline。
- 若设置 `Z_IMAGE_USE_DF11=1`，则进入 **DF11-only** 模式：
  - 不再依赖本地完整的浮点 Turbo 仓库；
  - 仅依赖一个已经构建好的 DF11 仓库（例如 `models/z-image-turbo-df11`）。

DF11 仓库需要具备以下结构（以 Turbo 为例）：

- `scheduler/`：调度器配置；
- `vae/`：VAE 全精度权重；
- `tokenizer/`：分词器；
- `text_encoder/`：Qwen3 文本编码器的 DF11 config + `model.safetensors`；
- `transformer/`：Z-Image DiT 主干的 DF11 config + `model.safetensors`。

运行模式：

- 默认情况下，`get_zimage_pipeline` 会从：

  - 本地 `MODELS_DIR/z-image-turbo`（若存在）；否则
  - 远端 `Tongyi-MAI/Z-Image-Turbo`，

  加载完整浮点权重。

- 当设置：

  ```env
  Z_IMAGE_VARIANT=turbo
  Z_IMAGE_USE_DF11=1
  ```

  时，代码会改为：

  - 从 DF11 仓库中分别加载 `scheduler` / `vae` / `tokenizer` 配置；
  - 只根据 DF11 目录下的 `config.json` 构造 Qwen3 文本编码器和 Z-Image DiT 架构；
  - 调用 `DFloat11Model.from_pretrained(...)` 在这些模块上注册 DF11 解码 hook，按 block 即时解压。

DF11 仓库位置：

- 默认 DF11 根目录为：

  ```text
  $MODELS_DIR/z-image-turbo-df11
  ```

- 也可以通过 `Z_IMAGE_DF11_ROOT` 自定义：

  ```env
  Z_IMAGE_USE_DF11=1
  Z_IMAGE_DF11_ROOT=/home/you/path/to/z-image-turbo-df11
  ```

### 8.6 Qwen3 text_encoder 的 CUDA_ERROR_INVALID_VALUE 调试记录

在把 Qwen3 text_encoder 也切到 DF11 时，遇到过一个比较隐蔽的问题：  
推理阶段一旦打开 `Z_IMAGE_USE_DF11_TEXT=1`，在 DF11 的 decode kernel 里报：

```text
cupy_backends.cuda.api.driver.CUDADriverError: CUDA_ERROR_INVALID_VALUE: invalid argument
```

调用栈落在：

- `dfloat11/dfloat11.py:decode_hook` → `_decode(..., shared_mem=module.shared_mem_size, ...)`
- `cupy.cuda.function.Function.__call__` → `launchKernel` → `CUDA_ERROR_INVALID_VALUE`

#### 根因：单 block shared memory 超过 GPU 上限

DF11 的 decode kernel 使用 per-block shared memory，大小由 `output_positions` 和 `threads_per_block` 决定：

```python
output_positions_np = output_positions.view(torch.uint32).numpy()
shared_mem_size = threads_per_block[0] * 4 + 4 + (output_positions_np[1:] - output_positions_np[:-1]).max().item() * 2
```

在我们用 RTX 3080（`shared_memory_per_block = 49152`）+ 默认 `threads_per_block = (512,)` 的 DF11 text_encoder 上，  
对某个 block（`layers.35.mlp.up_proj`）实测：

```text
max_delta(output_positions) = 32768
shared_mem_size = 512*4 + 4 + 32768*2 = 67588  >  49152
```

也就是说，DF11 kernel 想申请 ~66KB 的 shared memory，而 3080 单 block 只有 48KB，于是 CUDA 直接返回 `INVALID_VALUE`。

#### 诊断方法（用 uv 跑的脚本）

可以离线检查某个 DF11 模型（以 text_encoder 为例）对当前 GPU 是否安全：

```bash
uv run --project apps/worker python - << 'PY'
from pathlib import Path

import torch
from safetensors.torch import load_file

root = Path("models/z-image-turbo-text-encoder-df11/text_encoder")

props = torch.cuda.get_device_properties(0)
print("shared_memory_per_block:", props.shared_memory_per_block)

sd = load_file(str(root / "model.safetensors"))

threads_per_block = 512  # 或读取 config.json 里的 dfloat11_config.threads_per_block[0]
worst = None
for name, t in sd.items():
    if name.endswith("output_positions"):
        arr = t.view(torch.uint32).cpu().numpy()
        if arr.size < 2:
            continue
        diffs = (arr[1:] - arr[:-1]).max().item()
        shared_mem_size = threads_per_block * 4 + 4 + diffs * 2
        if worst is None or shared_mem_size > worst[0]:
            worst = (shared_mem_size, diffs, name)

print("Worst shared_mem_size:", worst)
PY
```

如果 `Worst shared_mem_size[0] > shared_memory_per_block`，就说明当前这份 DF11 模型在这块卡上会触发 `CUDA_ERROR_INVALID_VALUE`。

#### 修复方案：压缩时下调 text_encoder 的 threads_per_block

解决思路是：**压缩 text_encoder 时就用更小的 `threads_per_block`**，让每个 DF11 block 覆盖的元素数变小，从而降低 shared memory 需求。

本仓库里已经在 parallel 脚本里针对 text_encoder 写死了 override：

- 文件：`scripts/compress_z_image_dfloat11_parallel.py`
- 对 text_encoder 会传：`--threads-per-block-override 256` 给单进程脚本

推荐压缩命令（使用 parallel 版本）：

```bash
uv run --project apps/worker python -m scripts.compress_z_image_dfloat11_parallel \
  --component text_encoder \
  --model-path models/z-image-turbo \
  --save-path models/z-image-turbo-text-encoder-df11/text_encoder \
  --blocks-per-task 16 \
  --max-workers 3 \
  --save-single-file \
  --no-check-correctness
```

注意：我们在 `libs/py_core/dfloat11_ext.py` 里对 DF11 的 `compress_model` 做了一层 wrapper，  
确保 `threads_per_block_override` 真正改到的是 `dfloat11.dfloat11.threads_per_block` 这个全局变量，  
这样生成的 `config.json` 里的 `dfloat11_config.threads_per_block` 才会变成 `[256]`，而不是一直停留在 `[512]`。

压缩完成后可以用上面的诊断脚本再跑一遍，把 `threads_per_block` 换成 256，确认：

```text
Worst shared_mem_size[0] <= shared_memory_per_block
```

最后，在 worker 的 `.env` 里挂载新的 text_encoder DF11 目录：

```env
Z_IMAGE_USE_DF11_TEXT=1
Z_IMAGE_TEXT_DF11_DIR=models/z-image-turbo-text-encoder-df11/text_encoder
```

对 20GB + 48KB shared memory 的消费级卡（如 RTX 3080），`threads_per_block=256` 在当前 Qwen3 text_encoder 设置下能够避免 shared memory 超限，  
transformer 部分则可以继续使用默认的 DF11 配置。

这样整条多阶段链路（text_encoder + transformer）都会吃到 DF11 的显存节省，同时保持 bit-exact 行为。
在显存特别紧张的 20GB 卡上，还可以额外打开：

```env
Z_IMAGE_DF11_CPU_OFFLOAD=1
```

让 DF11 的压缩权重常驻在 CPU pinned 内存中，只在每个 block 计算前把当前 block 的 bitstream 异步拷到 GPU、用完即释放，从而压缩后权重几乎不占额外显存，只多一块“最大 block”的临时解码缓冲区。
