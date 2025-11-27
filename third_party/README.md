# third_party/

只存放 Git submodule 对应的上游仓库代码，视为只读。

- 不在此目录中添加业务逻辑。
- 不在此目录中放置模型权重或运行时数据。
- 需要修改上游代码请在上游仓库 fork 后修改，并更新 submodule 指向的 commit。
- 当前已存在的 submodule：
  - `third_party/Z-Image`：官方 Z-Image 仓库，仅包含 README / 报告等说明文档。
    模型实际推理通过 Hugging Face diffusers 的 `ZImagePipeline` 完成，封装层位于
    `libs/py_core/z_image_pipeline.py`。
