// src/types/plotly.d.ts
declare module 'react-plotly.js' {
  import type { ComponentType } from 'react';

  const Plot: ComponentType<any>;
  export default Plot;
}

declare module 'plotly.js-dist-min';
