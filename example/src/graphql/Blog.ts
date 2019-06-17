import { objectType } from 'nexus-tmp-chainable-method';

export const Blog = objectType({
  name: 'Blog',
  definition(t) {
    t.model.id();
    t.model.name();
    t.model.posts({ type: 'CustomPost' });
    t.model.viewCount();
    t.model.authors();
  }
});
