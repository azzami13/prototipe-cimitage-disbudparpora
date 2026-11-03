import { BadRequestException } from '@nestjs/common';
import { createUploadOptions, MAX_UPLOAD_SIZE } from './upload-options';

describe('upload validation', () => {
  it('rejects SVG and script-capable image MIME types', () => {
    const options = createUploadOptions('profile');
    const callback = jest.fn();

    options.fileFilter(
      {} as any,
      { mimetype: 'image/svg+xml' } as any,
      callback,
    );

    expect(callback).toHaveBeenCalledWith(
      expect.any(BadRequestException),
      false,
    );
  });

  it('configures a hard 5 MB single-file limit', () => {
    const options = createUploadOptions('booking-payments', true);
    expect(options.limits).toEqual({ fileSize: MAX_UPLOAD_SIZE, files: 1 });
    expect(MAX_UPLOAD_SIZE).toBe(5 * 1024 * 1024);
  });

  it('generates a server-side UUID filename from trusted MIME type', () => {
    const options = createUploadOptions('profile');
    const callback = jest.fn();
    const file = {
      mimetype: 'image/png',
      originalname: '../../payload.svg',
    } as any;
    options.fileFilter({} as any, file, callback);
    const filename = file.originalname as string;
    expect(filename).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(filename).not.toContain('payload');
    expect(callback).toHaveBeenCalledWith(null, true);
  });
});
