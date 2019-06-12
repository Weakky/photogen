import * as fs from 'fs';
import { transformDMMF } from '../dmmf/dmmf-transformer';
import { ExternalDMMF as DMMF } from '../dmmf/dmmf-types';
import {
  getSupportedMutations,
  getSupportedQueries
} from '../photogen/supported-ops';

type DMMF = DMMF.Document;

export function generatePhotogenTypes(
  dmmf: DMMF,
  photogenPath: string
): string {
  return render(dmmf, photogenPath);
}

function render(dmmf: DMMF, photogenPath: string) {
  return `\
import * as photon from '${photogenPath}';
import { core } from 'nexus';
// Types helpers
${renderStaticTypes()}

// Generated
${renderModelTypes(dmmf)}
${renderPhotogenInputs(dmmf)}
${renderPhotogenTypes(dmmf)}
${renderPhotogenMethods(dmmf)}

declare global {
  type Photogen<TypeName extends string> = <
    ModelName extends keyof PhotogenMethods<GetPhotogenDefinition<TypeName>>
  >(
    modelName: ModelName
  ) => PhotogenMethods<GetPhotogenDefinition<TypeName>>[ModelName];
}
  `;
}

function renderModelTypes(dmmf: DMMF) {
  return `\
interface ModelTypes {
${dmmf.datamodel.models.map(m => `  ${m.name}: photon.${m.name}`).join('\n')}
}
  `;
}

function renderPhotogenTypes(dmmf: DMMF) {
  const queryType = dmmf.schema.outputTypes.find(t => t.name === 'Query')!;

  const queriesByType = dmmf.datamodel.models.reduce<
    Record<string, { fieldName: string; returnType: string }[]>
  >((acc, m) => {
    const mapping = dmmf.mappings.find(mapping => mapping.model === m.name)!;
    const supportedQueries = getSupportedQueries(mapping);

    const typeQueries = queryType.fields
      .filter(q => supportedQueries.includes(q.name))
      .map(q => ({
        fieldName: q.name,
        returnType: q.outputType.type
      }));

    acc[m.name] = typeQueries;

    return acc;
  }, {});

  const mutationType = dmmf.schema.outputTypes.find(
    t => t.name === 'Mutation'
  )!;
  const mutationsByType = dmmf.datamodel.models.reduce<
    Record<string, { fieldName: string; returnType: string }[]>
  >((acc, m) => {
    const mapping = dmmf.mappings.find(mapping => mapping.model === m.name)!;
    const supportedMutations = getSupportedMutations(mapping);

    const typeMutations = mutationType.fields
      .filter(q => supportedMutations.includes(q.name))
      .map(q => ({
        fieldName: q.name,
        returnType: q.outputType.type
      }));

    acc[m.name] = typeMutations;

    return acc;
  }, {});
  const fieldsByType = dmmf.datamodel.models.reduce<
    Record<string, { fieldName: string; returnType: string }[]>
  >((acc, m) => {
    acc[m.name] = m.fields.map(f => ({
      fieldName: f.name,
      returnType: f.type
    }));

    return acc;
  }, {});

  // TODO: Add JS Docs
  const renderPhotogenType = (
    input: Record<
      string,
      {
        fieldName: string;
        returnType: string;
      }[]
    >
  ): string => `\
${Object.entries(input)
  .map(
    ([typeName, fields]) => `  ${typeName}: {
${fields.map(f => `    ${f.fieldName}: '${f.returnType}'`).join('\n')}
  }`
  )
  .join('\n')}
`;

  return `\
interface PhotogenTypes {
  Query: {
${renderPhotogenType(queriesByType)}
  },
  Mutation: {
${renderPhotogenType(mutationsByType)}
  },
  Read: {
${renderPhotogenType(fieldsByType)}
  },
}
`;
}

function renderPhotogenInputs(dmmf: DMMF) {
  const queryType = dmmf.schema.outputTypes.find(t => t.name === 'Query')!;

  const queriesByType = dmmf.datamodel.models.reduce<
    Record<
      string,
      {
        fieldName: string;
        filtering: DMMF.InputType;
        ordering: DMMF.InputType;
      }[]
    >
  >((acc, m) => {
    const typeQueries = queryType.fields
      .filter(q => q.outputType.isList && q.outputType.kind === 'object')
      .map(q => {
        const whereArg = q.args.find(a => a.name === 'where')!;
        const orderByArg = q.args.find(a => a.name === 'orderBy')!;
        const whereInput = dmmf.schema.inputTypes.find(
          i => i.name === whereArg.inputType.type
        )!;
        const orderByInput = dmmf.schema.inputTypes.find(
          i => i.name === orderByArg.inputType.type
        )!;

        return {
          fieldName: q.name,
          filtering: whereInput,
          ordering: orderByInput
        };
      });

    acc[m.name] = typeQueries;

    return acc;
  }, {});

  const fieldsByType = dmmf.datamodel.models
    .map(m => dmmf.schema.outputTypes.find(o => o.name === m.name)!)
    .reduce<
      Record<
        string,
        {
          fieldName: string;
          filtering: DMMF.InputType;
          ordering: DMMF.InputType;
        }[]
      >
    >((acc, type) => {
      acc[type.name] = type.fields
        .filter(f => f.outputType.isList && f.outputType.kind === 'object')
        .map(f => {
          const whereArg = f.args.find(a => a.name === 'where')!;

          if (!whereArg) {
            console.log(f.name, f.args);
          }

          const orderByArg = f.args.find(a => a.name === 'orderBy')!;
          const whereInput = dmmf.schema.inputTypes.find(
            i => i.name === whereArg.inputType.type
          )!;
          const orderByInput = dmmf.schema.inputTypes.find(
            i => i.name === orderByArg.inputType.type
          )!;

          return {
            fieldName: f.name,
            filtering: whereInput,
            ordering: orderByInput
          };
        });

      return acc;
    }, {});

  // TODO: Add JS Docs
  const renderPhotogenInput = (
    input: Record<
      string,
      {
        fieldName: string;
        filtering: DMMF.InputType;
        ordering: DMMF.InputType;
      }[]
    >
  ): string => `\
${Object.entries(input)
  .map(
    ([typeName, fields]) => `  ${typeName}: {
${fields
  .map(
    f => `    ${f.fieldName}: {
  filtering: ${f.filtering.fields.map(f => `'${f.name}'`).join(' | ')}
  ordering: ${f.ordering.fields.map(f => `'${f.name}'`).join(' | ')}
}`
  )
  .join('\n')}
  }`
  )
  .join('\n')}
`;

  return `\
interface PhotogenInputs {
  Query: {
${renderPhotogenInput(queriesByType)}
  },
  Read: {
${renderPhotogenInput(fieldsByType)}
  },
}
`;
}

function renderPhotogenMethods(dmmf: DMMF) {
  return `\
interface PhotogenMethods<Definition extends keyof PhotogenTypes> {
${dmmf.datamodel.models.map(
  m => `  ${m.name}: PhotogenFields<'${m.name}', Definition>`
)}
}
  `;
}

function renderStaticTypes() {
  return `\
  type ModelNameExistsInGraphQLType<
    ReturnType extends any
  > = ReturnType extends core.GetGen<'objectNames'> ? true : false;
  
  type PhotogenScalarOpts = {
    alias?: string;
  };
  
  type Pagination = {
    first?: boolean;
    last?: boolean;
    before?: boolean;
    after?: boolean;
    skip?: boolean;
  };
  
  type RootObjectTypes = Pick<
    core.GetGen<'rootTypes'>,
    core.GetGen<'objectNames'>
  >;
  
  type IsSubset<A, B> = keyof A extends never
    ? false
    : B extends A
    ? true
    : false;
  
  type OmitByValue<T, ValueType> = Pick<
    T,
    { [Key in keyof T]: T[Key] extends ValueType ? never : Key }[keyof T]
  >;
  
  type GetSubsetTypes<ModelName extends any> = keyof OmitByValue<
    {
      [P in keyof RootObjectTypes]: ModelName extends keyof ModelTypes
        ? IsSubset<RootObjectTypes[P], ModelTypes[ModelName]> extends true
          ? RootObjectTypes[P]
          : never
        : never;
    },
    never
  >;
  
  type SubsetTypes<ModelName extends any> = GetSubsetTypes<
    ModelName
  > extends never
    ? \`ERROR: No subset types are available. Please make sure that one of your GraphQL type is a subset of your t.photogen('<ModelName>')\`
    : GetSubsetTypes<ModelName>;
  
  type DynamicRequiredType<ReturnType extends any> = ModelNameExistsInGraphQLType<
    ReturnType
  > extends true
    ? { type?: SubsetTypes<ReturnType> }
    : { type: SubsetTypes<ReturnType> };
  
  type GetPhotogenInput<
    Definition extends any,
    ModelName extends any,
    MethodName extends any,
    InputName extends 'filtering' | 'ordering'
  > = Definition extends keyof PhotogenInputs
    ? ModelName extends keyof PhotogenInputs[Definition]
      ? MethodName extends keyof PhotogenInputs[Definition][ModelName]
        ? PhotogenInputs[Definition][ModelName][MethodName][InputName]
        : never
      : never
    : never;
  
  type PhotogenRelationOpts<
    Definition extends any,
    ModelName extends any,
    MethodName extends any,
    ReturnType extends any
  > = GetPhotogenInput<
    // If GetPhotogenInput returns never, it means there are no filtering/ordering args for it. So just use \`alias\` and \`type\`
    Definition,
    ModelName,
    MethodName,
    'filtering'
  > extends never
    ? {
        alias?: string;
      } & DynamicRequiredType<ReturnType>
    : {
        alias?: string;
        filtering?:
          | boolean
          | Partial<
              Record<
                GetPhotogenInput<Definition, ModelName, MethodName, 'filtering'>,
                boolean
              >
            >;
        ordering?:
          | boolean
          | Partial<
              Record<
                GetPhotogenInput<Definition, ModelName, MethodName, 'ordering'>,
                boolean
              >
            >;
        pagination?: boolean | Pagination;
      } & DynamicRequiredType<ReturnType>;
  
  type IsScalar<TypeName extends any> = TypeName extends core.GetGen<
    'scalarNames'
  >
    ? true
    : false;
  
  type PhotogenFields<
    ModelName extends keyof PhotogenTypes[Definition],
    Definition extends keyof PhotogenTypes
  > = {
    [MethodName in keyof PhotogenTypes[Definition][ModelName]]: PhotogenMethod<
      Definition,
      ModelName,
      MethodName,
      IsScalar<PhotogenTypes[Definition][ModelName][MethodName]> // Is the return type a scalar?
    >;
  };
  
  type PhotogenMethod<
    Definition extends keyof PhotogenTypes,
    ModelName extends keyof PhotogenTypes[Definition],
    MethodName extends keyof PhotogenTypes[Definition][ModelName],
    IsScalar extends boolean,
    ReturnType extends any = PhotogenTypes[Definition][ModelName][MethodName]
  > = IsScalar extends true // If scalar
    ? (opts?: PhotogenScalarOpts) => PhotogenFields<ModelName, Definition> // Return optional scalar opts
    : ModelNameExistsInGraphQLType<ReturnType> extends true // If model name has a mapped graphql types
    ? (
        opts?: PhotogenRelationOpts<Definition, ModelName, MethodName, ReturnType>
      ) => PhotogenFields<ModelName, Definition> // Then make opts optional
    : (
        opts: PhotogenRelationOpts<Definition, ModelName, MethodName, ReturnType>
      ) => PhotogenFields<ModelName, Definition>; // Else force use input the related graphql type -> { type: '...' }
  
  type GetPhotogenDefinition<
    TypeName extends string
  > = TypeName extends 'Mutation'
    ? 'Mutation'
    : TypeName extends 'Query'
    ? 'Query'
    : 'Read';  
  `;
}
