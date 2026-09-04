import type { IProjectConfig } from "@tarojs/taro/types/compile";

const config: IProjectConfig = {
  mini: {
    postcss: {
      autoprefixer: { enable: true },
      pxtransform: { enable: true, config: {} },
    },
  },
  h5: {},
};

export default config;
