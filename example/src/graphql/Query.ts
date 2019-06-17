import { objectType } from '@prisma/nexus';

export const Query = objectType({
  name: 'Query',
  definition(t) {
    t.crud.findManyBlog({ alias: 'blogs', filtering: { id: true } });
    t.crud.findOneBlog({ alias: 'blog' });
    t.crud.findManyAuthor();
    t.crud.findManyPost({ type: 'CustomPost' });
  }
});
