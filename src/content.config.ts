import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        /**
         * The action's file this page is read from, relative to its repository root, such as
         * `docs/configuration.md`. The footer links it at the pinned tag. Leave it out on a
         * page written in this repository: the footer then links to the page's own file.
         */
        source: z.string().optional(),
      }),
    }),
  }),
};
