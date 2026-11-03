import { getFrontendOrigins } from './cors-origins';

describe('frontend CORS origins', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('uses only configured production origins and rejects wildcard', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL =
      '*,https://*,http://insecure.example.id,https://cimitage.vercel.app,https://cimitage.example.id/';

    expect(getFrontendOrigins()).toEqual([
      'https://cimitage.vercel.app',
      'https://cimitage.example.id',
    ]);
    expect(getFrontendOrigins()).not.toContain('*');
    expect(getFrontendOrigins()).not.toContain('http://localhost:3000');
  });
});
