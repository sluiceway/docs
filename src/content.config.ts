import { defineCollection } from "astro:content";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";
import { actionDocsLoader } from "./loaders/action-docs";

export const collections = {
  docs: defineCollection({
    loader: actionDocsLoader(),
    schema: docsSchema({
      extend: z.object({
        /**
         * The action's file this page is read from, relative to its repository root, such as
         * `docs/configuration.md`. The footer links it at the pinned tag. Leave it out on a
         * page written in this repository: the footer then links to the page's own file.
         */
        source: z.string().optional(),
        /** One of Penny's header pictures above the page's content, from HeaderPicture. */
        headerPicture: z.object({ picture: z.string(), alt: z.string() }).optional(),
        /** A line above the content, such as "Decision record 0012", with Penny's mark. */
        eyebrow: z.string().optional(),
      }),
    }),
  }),
};
