import Archiver from 'archiver';
import { Readable } from 'stream';
import path from 'path';
import { successResponse, runWarm, s3Handler } from  '../utils';

const archive = Archiver('zip');
type S3DownloadStreamDetails = { stream: Readable; filename: string };

class ZipHandler {
  keys: string[];
  archiveFilename: string;
  archiveFolderName: string;
  // archive: Archiver.Archiver;
  constructor(keys: string[], archiveFilename: string, archiveFolderName: string) {
    this.keys = keys;
    this.archiveFilename = archiveFilename;
    this.archiveFolderName = archiveFolderName;

    archive.on('error', (error: Archiver.ArchiverError) => {
      throw new Error(`${error.name} ${error.code} ${error.message} ${error.path}
      ${error.stack}`);
    });
  }

  s3DownloadStreams(): S3DownloadStreamDetails[] {
    return this.keys.map((key: string) => {
      return {
        stream: s3Handler.readStream(process.env.BUCKET, key),
        filename: `${this.archiveFolderName}\\${path.basename(key)}`,
      };
    });
  }

  async process() {
    const { s3StreamUpload, uploaded } = s3Handler.writeStream
    (process.env.ZIP_BUCKET, this.archiveFilename);
    const s3DownloadStreams = this.s3DownloadStreams();

    await new Promise((resolve, reject) => {
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

const zipHandler: Function = async () => {
  // successResponse handles wrapping the response in an API Gateway friendly
  // format (see other responses, including CORS, in `./utils/lambdaResponse.js)

  console.time('zipProcess');

  const keys: string[] = ['uploaders/1/blueprint-file/2ee8715f-7ef0-4c09-b75f-e48a1cda0f8e/bowser_low_poly_flowalistik (1).STL',
  'uploaders/1/blueprint-file/d84abda0-bd93-4fef-b213-56a09058fd7c/pp spool holder v1.stl'
  ];

  const archiveFilename: string = 'uploads/design_zip/file/1/battle-cat-keychain-dual-extrusion20190615-6f7iesdr.zip';

  const archiveFolderName: string = 'samet/battle-cat-keychain-dual-extrusion';

  const zipHandler = new ZipHandler(keys, archiveFilename, archiveFolderName);
  await zipHandler.process();

  const response = successResponse({
    message: 'Go Serverless! Your function executed successfully!',
    data: archiveFilename
  });

  console.timeEnd('zipProcess');
  return response;
};

// runWarm function handles pings from the scheduler so you don't
// have to put that boilerplate in your function.
export default runWarm(zipHandler);
