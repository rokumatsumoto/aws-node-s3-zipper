import Archiver from 'archiver';
import { Readable } from 'stream';
import path from 'path';
import { successResponse, runWarm, s3Handler } from  '../utils';

type S3DownloadStreamDetails = { stream: Readable; filename: string };

interface Zip {
  keys: string[];
  archiveFilePath: string;
  archiveFolderPath: string;
  archiveFormat: Archiver.Format;
}

class ZipHandler {
  keys: string[];
  archiveFilePath: string;
  archiveFolderPath: string;
  archiveFormat: Archiver.Format;
  constructor(keys: string[], archiveFilePath: string, archiveFolderPath: string, archiveFormat: Archiver.Format) {
    this.keys = keys;
    this.archiveFilePath = archiveFilePath;
    this.archiveFolderPath = archiveFolderPath;
    this.archiveFormat = archiveFormat;
  }

  s3DownloadStreams(): S3DownloadStreamDetails[] {
    return this.keys.map((key: string) => {
      return {
        stream: s3Handler.readStream(process.env.BUCKET, key),
        filename: `${this.archiveFolderPath}\\${path.basename(key)}`,
      };
    });
  }

  async process() {
    const { s3StreamUpload, uploaded } = s3Handler.writeStream
      (process.env.ZIP_BUCKET, this.archiveFilePath);
    const s3DownloadStreams = this.s3DownloadStreams();

    await new Promise((resolve, reject) => {
      const archive = Archiver(this.archiveFormat);
      archive.on('error', (error: Archiver.ArchiverError) => {
        throw new Error(`${error.name} ${error.code} ${error.message} ${error.path}
      ${error.stack}`);
      });

      console.log('Starting upload');
      s3StreamUpload.on('close', resolve);
      s3StreamUpload.on('end', resolve);
      s3StreamUpload.on('error', reject);

      archive.pipe(s3StreamUpload);
      s3DownloadStreams.forEach((streamDetails: S3DownloadStreamDetails) =>            archive.append(streamDetails.stream, { name: streamDetails.filename })
      );
      archive.finalize();
    }).catch((error: { code: string; message: string; data: string }) => {
      throw new Error(`${error.code} ${error.message} ${error.data}`);
    });

    await uploaded.promise();
    console.log('done');
  }
}

const zipHandler: Function = async (event: Zip) => {
  // successResponse handles wrapping the response in an API Gateway friendly
  // format (see other responses, including CORS, in `./utils/lambdaResponse.js)

  console.time('zipProcess');
  console.log(event);

  // https://stackoverflow.com/q/56188864/2015025
  // Lambda is standalone service that doesn't need to be integrated with API Gateway. queryStringParameters, body, body mapping templates, all of this is specific not to Lambda, but to Lambda - API Gateway integration.
  const { keys, archiveFilePath, archiveFolderPath, archiveFormat } = event;

  // TODO: refactor (parameter count)
  const zipHandler = new ZipHandler(keys, archiveFilePath, archiveFolderPath, archiveFormat);
  await zipHandler.process();

  const response = successResponse({
    message: archiveFilePath
  });

  console.timeEnd('zipProcess');
  return response;
};

// runWarm function handles pings from the scheduler so you don't
// have to put that boilerplate in your function.
export default runWarm(zipHandler);
