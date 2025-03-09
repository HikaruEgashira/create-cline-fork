#!/usr/bin/env node

import { main } from '../src/index.js';

// プロセス終了時のエラーハンドリング
process.on('unhandledRejection', (err: any) => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
});

// メイン処理の呼び出し
main();
