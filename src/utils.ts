export const keyBy: <T>(
  collection: T[],
  iteratee: (value: T) => string
) => Record<string, T> = (collection, iteratee) => {
  return collection.reduce<any>((acc, curr) => {
    acc[iteratee(curr)] = curr;
    return acc;
  }, {});
};

export const upperFirst = (s: string): string => {
  return s.replace(/^\w/, c => c.toUpperCase());
};

export function nexusOpts(param: {
  type: string;
  isList: boolean;
  isRequired: boolean;
}): {
  type: any;
  list: true | undefined;
  nullable: boolean;
} {
  return {
    type: param.type as any,
    list: param.isList ? true : undefined,
    nullable: !param.isRequired
  };
}

export function assertPhotonInContext(photon: any) {
  if (!photon) {
    throw new Error('Could not find photon in context');
  }
}
