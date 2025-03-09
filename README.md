# create-cline-app

このプロジェクトは、cline フォークを作成するコマンドラインツールです。

```bash
bun create cline hoge
# generate ./hoge/hoge.vsix
```

## Development

```bash
bun install
bun run create mycline
cd mycline
bun run install:all
bun x vsce package
# generate ./mycline/mycline.vsix
```

## ライセンス

MIT
