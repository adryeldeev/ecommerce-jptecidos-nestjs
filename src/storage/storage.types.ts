export type UploadFileInput = {
  buffer: Buffer;
  originalName: string;
  contentType?: string;
  folder: string;
};

export type UploadFileResult = {
  key: string;
  url: string;
};
