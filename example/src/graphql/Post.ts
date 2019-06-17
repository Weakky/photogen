import { objectType } from 'nexus-tmp-chainable-method';

export const Post = objectType({
  name: 'CustomPost',
  definition(t) {
    t.model('Post').id();
    t.model('Post').title();
    t.model('Post').tags();
  }
});
