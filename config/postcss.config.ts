interface PostCSSConfig {
  plugins: {
    tailwindcss: Record<string, unknown>;
    autoprefixer: Record<string, unknown>;
  };
}

const config: PostCSSConfig = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;