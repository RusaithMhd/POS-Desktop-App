const isElectronBuild = process.env.IS_ELECTRON_BUILD === 'true';

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  ...(isElectronBuild ? { output: 'export', trailingSlash: true } : {}),
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Fallback for sql.js and node native modules in browser bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    } else {
      config.externals = [...(config.externals || []), 'sql.js'];
    }
    return config;
  },
};

export default nextConfig;
