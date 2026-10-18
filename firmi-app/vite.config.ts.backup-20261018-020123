import vinext from "vinext";
import { defineConfig } from "vite";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    vinext({ prerender: { routes: "*" } ,
    cache: {
      data: kvDataAdapter(),
      cdn: cdnAdapter(),
    },
    images: { optimizer: imagesOptimizer() },
}),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
