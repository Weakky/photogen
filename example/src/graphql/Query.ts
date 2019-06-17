import { objectType } from 'nexus-tmp-chainable-method';

export const Query = objectType({
  name: 'Query',
  definition(t) {
    t.crud.findManyBlog({ alias: 'blogs', filtering: { id: true } });
    t.crud.findOneBlog({ alias: 'blog' });
    t.crud.findManyAuthor();
    t.crud.findManyPost({ type: 'CustomPost' });
  }
});
