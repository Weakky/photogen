import { objectType } from 'nexus-tmp-chainable-method';

export const Author = objectType({
  name: 'Author',
  definition(t) {
    t.model.id();
    t.model.name();
    t.model.blog();
    t.model.posts({ type: "CustomPost" });
  }
});
