import { objectType } from 'nexus-tmp-chainable-method';

export const Author = objectType({
  name: 'Author',
  definition(t) {
    t.photogen('Author')
      .id()
      .name()
      .blog()
      .posts();
  }
});
