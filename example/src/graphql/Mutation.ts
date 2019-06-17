import { objectType } from "nexus-tmp-chainable-method/dist";

export const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.crud.createOneBlog()
  }
})