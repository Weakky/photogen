import { objectType } from 'nexus-tmp-chainable-method';

export const Query = objectType({
  name: 'Query',
  definition(t) {
    t.photogen('Blog')
      .blog()
      .blogs();

    t.photogen('Author')
      .author()
      .authors();

    t.photogen('Post')
      .post()
      .posts();
  }
});
