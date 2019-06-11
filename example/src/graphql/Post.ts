import { objectType } from "nexus-tmp-chainable-method";

export const Post = objectType({
  name: 'Post',
  definition(t) {
    t.photogen('Post')
      .id()
      .title()
      .tags()
      .blog()
      .author();
  }
});