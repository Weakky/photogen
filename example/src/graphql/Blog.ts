import { objectType } from 'nexus-tmp-chainable-method';

export const Blog = objectType({
  name: 'Blog',
  definition(t) {
    t.photogen('Blog')
      .id()
      .name()
      .posts()
      .viewCount()
      .authors();
  }
});
