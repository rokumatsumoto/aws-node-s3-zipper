import * as ts from 'typescript';
// Note: the snippet below is module augmentation.Files containing module augmentation must be modules(as opposed to scripts).The difference between modules and scripts is that modules have at least one import /export statement.

// In order to make TypeScript treat your file as a module, just add one import statement to it.It can be anything.Even import * as ts from 'typescript' will do.

// https://stackoverflow.com/a/53981706/2015025

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BUCKET: string;
      ZIP_BUCKET: string;
    }
  }
}
