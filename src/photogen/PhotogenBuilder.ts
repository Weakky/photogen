import {
  core,
  dynamicOutputMethod,
  enumType,
  inputObjectType
} from 'nexus-tmp-chainable-method';
import { transformDMMF } from '../dmmf/dmmf-transformer';
import { ExternalDMMF as DMMF } from '../dmmf/dmmf-types';
import { DMMFClass } from '../dmmf/DMMFClass';
import { PhotogenParams } from '../photogen';
import { defaultNamingStrategy, INamingStrategy } from './StrategyNaming';
import { getSupportedMutations, getSupportedQueries } from './supported-ops';
import { assertPhotonInContext, nexusOpts } from '../utils';

interface PhotogenMethodParams {
  alias?: string;
  type?: string;
  pagination?: boolean | Record<string, boolean>;
  filtering?: boolean | Record<string, boolean>;
  ordering?: boolean | Record<string, boolean>;
}

export class PhotogenBuilder {
  protected readonly dmmf: DMMFClass;
  protected builtInputTypesMap: Record<string, boolean>;
  protected whitelistMap: Record<string, string[]>;
  protected namingStrategy: INamingStrategy;

  constructor(protected params: PhotogenParams) {
    // @ts-ignore
    const transformedDMMF = __DMMF__;

    this.dmmf = new DMMFClass(transformedDMMF);
    this.namingStrategy = defaultNamingStrategy;
    this.builtInputTypesMap = {};
    this.whitelistMap = {};
  }

  getPhotogenMethod() {
    if (!this.params.methodName) {
      this.params.methodName = 'photogen';
    }
    if (!this.params.photon) {
      this.params.photon = ctx => ctx.photon;
    }

    return dynamicOutputMethod({
      name: this.params.methodName,
      typeDefinition: `: Photogen<TypeName>`,
      factory: ({ typeDef: t, typeName: graphQLTypeName, args }) => {
        const [prismaModelName] = args as [string];
        const mapping = this.dmmf.getMapping(prismaModelName);

        if (graphQLTypeName === 'Query') {
          const queriesNames = getSupportedQueries(mapping);
          const queryFields = this.dmmf.queryType.fields.filter(query =>
            queriesNames.includes(query.name)
          );

          return this.buildSchemaFor(
            t,
            prismaModelName,
            'Query',
            queryFields,
            mapping
          );
        }

        if (graphQLTypeName === 'Mutation') {
          const mutationsNames = getSupportedMutations(mapping);
          const mutationFields = this.dmmf.mutationType.fields.filter(
            mutation => mutationsNames.includes(mutation.name)
          );

          return this.buildSchemaFor(
            t,
            prismaModelName,
            'Mutation',
            mutationFields,
            mapping
          );
        }

        return this.buildSchemaForPrismaModel(
          prismaModelName,
          graphQLTypeName,
          t
        );
      }
    });
  }

  protected computeArgsFromField(
    prismaModelName: string,
    graphQLTypeName: string,
    field: DMMF.SchemaField,
    opts: PhotogenMethodParams
  ) {
    let args: DMMF.SchemaArg[] = [];

    if (graphQLTypeName === 'Mutation') {
      args = field.args;
    } else {
      args = this.argsForQueryOrModelField(
        prismaModelName,
        graphQLTypeName,
        field,
        opts
      );
    }

    return this.dmmfArgsToNexusArgs(graphQLTypeName, field, args);
  }

  protected argsForQueryOrModelField(
    prismaModelName: string,
    graphQLTypeName: string,
    field: DMMF.SchemaField,
    opts: PhotogenMethodParams
  ) {
    let args: DMMF.SchemaArg[] = [];

    if (opts.filtering) {
      const whereArg = field.args.find(
        a =>
          a.inputType.type === `${prismaModelName}WhereInput` &&
          a.name === 'where'
      );

      if (!whereArg) {
        throw new Error(
          `Could not find filtering argument for ${prismaModelName}.${field.name}`
        );
      }

      if (opts.filtering !== true) {
        this.whitelistMap[
          this.argTypeName(
            graphQLTypeName,
            field.name,
            whereArg.inputType.type,
            whereArg.inputType.kind
          )
        ] = Object.keys(opts.filtering).filter(
          fieldName => (opts.filtering as any)[fieldName] === true
        );
      }

      args.push(whereArg);
    }

    if (opts.ordering) {
      const orderByArg = field.args.find(
        a =>
          a.inputType.type === `${prismaModelName}OrderByInput` &&
          a.name === 'orderBy'
      );

      if (!orderByArg) {
        throw new Error(
          `Could not find ordering argument for ${prismaModelName}.${field.name}`
        );
      }

      if (opts.ordering !== true) {
        this.whitelistMap[
          this.argTypeName(
            graphQLTypeName,
            field.name,
            orderByArg.inputType.type,
            orderByArg.inputType.kind
          )
        ] = Object.keys(opts.ordering).filter(
          fieldName => (opts.ordering as any)[fieldName] === true
        );
      }

      args.push(orderByArg);
    }

    if (opts.pagination) {
      if (opts.pagination === true) {
        const paginationKeys = ['first', 'last', 'before', 'after', 'skip'];

        args.push(...field.args.filter(a => paginationKeys.includes(a.name)));
      } else {
        const paginationKeys = Object.keys(opts.pagination);

        args.push(...field.args.filter(a => paginationKeys.includes(a.name)));
      }
    }

    return args;
  }

  protected dmmfArgsToNexusArgs(
    parentTypeName: string,
    field: DMMF.SchemaField,
    args: DMMF.SchemaArg[]
  ) {
    return args.reduce<Record<string, any>>((acc, arg) => {
      if (arg.inputType.kind === 'scalar') {
        acc[arg.name] = core.arg(nexusOpts(arg.inputType));
      } else {
        if (!this.builtInputTypesMap[arg.inputType.type]) {
          acc[arg.name] = this.createInputEnumType(parentTypeName, field, arg);
        } else {
          acc[arg.name] = core.arg(
            nexusOpts({
              ...arg.inputType,
              type: this.argTypeName(
                parentTypeName,
                field.name,
                arg.inputType.type,
                arg.inputType.kind
              )
            })
          );
        }
      }
      return acc;
    }, {});
  }

  protected buildSchemaFor(
    t: core.OutputDefinitionBlock<any>,
    prismaModelName: string,
    parentTypeName: string,
    fields: DMMF.SchemaField[],
    mapping: DMMF.Mapping
  ) {
    const result = fields.reduce<
      Record<string, (opts?: PhotogenMethodParams) => any>
    >((acc, field) => {
      acc[field.name] = opts => {
        if (!opts) {
          opts = {};
        }
        if (!opts.pagination) {
          opts.pagination = true;
        }
        const fieldName = opts.alias ? opts.alias : field.name;
        const type = opts.type ? opts.type : field.outputType.type;

        const operationName = Object.keys(mapping).find(
          key => (mapping as any)[key] === field.name
        );

        if (!operationName) {
          throw new Error(
            'Could not find operation name for field ' + field.name
          );
        }

        t.field(fieldName, {
          ...nexusOpts({ ...field.outputType, type }),
          args: this.computeArgsFromField(
            prismaModelName,
            parentTypeName,
            field,
            opts
          ),
          resolve: (_, args, ctx) => {
            const photon = this.params.photon(ctx);

            assertPhotonInContext(photon);

            return photon[mapping.findMany!][operationName](args);
          }
        });

        return result;
      };
      return acc;
    }, {});

    return result;
  }

  protected createInputEnumType(
    parentTypeName: string,
    field: DMMF.SchemaField,
    arg: DMMF.SchemaArg
  ) {
    this.builtInputTypesMap[
      this.argTypeName(
        parentTypeName,
        field.name,
        arg.inputType.type,
        arg.inputType.kind
      )
    ] = true;

    if (arg.inputType.kind === 'enum') {
      const eType = this.dmmf.getEnumType(arg.inputType.type);

      return enumType({
        name: eType.name,
        members: eType.values
      });
    } else {
      const input = this.dmmf.getInputType(arg.inputType.type);

      const inputName =
        input.isWhereType ||
        input.isOrderType ||
        this.isRelationFilterArg(input.name)
          ? this.argTypeName(parentTypeName, field.name, input.name, 'object')
          : input.name;

      const filteredFields = this.whitelistMap[inputName]
        ? input.fields.filter(f =>
            this.whitelistMap[inputName].includes(f.name)
          )
        : input.fields;

      return inputObjectType({
        name: inputName,
        definition: t => {
          filteredFields.forEach(inputArg => {
            if (inputArg.inputType.kind === 'scalar') {
              t.field(inputArg.name, nexusOpts(inputArg.inputType));
            } else {
              const argumentTypeName = this.argTypeName(
                parentTypeName,
                field.name,
                inputArg.inputType.type,
                inputArg.inputType.kind
              );
              const type =
                this.builtInputTypesMap[argumentTypeName] === true
                  ? argumentTypeName
                  : (this.createInputEnumType(
                      parentTypeName,
                      field,
                      inputArg
                    ) as any);

              t.field(
                inputArg.name,
                nexusOpts({ ...inputArg.inputType, type })
              );
            }
          });
        }
      });
    }
  }

  protected buildSchemaForPrismaModel(
    prismaModelName: string,
    graphQLTypeName: string,
    t: core.OutputDefinitionBlock<any>
  ) {
    const model = this.dmmf.getModel(prismaModelName);
    const outputType = this.dmmf.getOutputType(model.name);

    const result = model.fields.reduce<
      Record<string, (opts?: PhotogenMethodParams) => any>
    >((acc, modelField) => {
      const graphqlField = outputType.fields.find(
        f => f.name === modelField.name
      )!;

      if (!graphqlField) {
        throw new Error(
          `Could not find graphql field ${model.name}.${modelField.name}`
        );
      }

      acc[graphqlField.name] = opts => {
        if (!opts) {
          opts = {};
        }
        if (!opts.pagination) {
          opts.pagination = true;
        }
        const fieldName = opts.alias ? opts.alias : modelField.name;
        const type = opts.type ? opts.type : graphqlField.outputType.type;
        const fieldOpts: core.NexusOutputFieldConfig<any, string> = {
          ...nexusOpts({ ...graphqlField.outputType, type }),
          args: this.computeArgsFromField(
            prismaModelName,
            graphQLTypeName,
            graphqlField,
            opts
          )
        };
        // Rely on default resolvers for scalars
        if (modelField.kind !== 'scalar') {
          const mapping = this.dmmf.getMapping(prismaModelName);

          fieldOpts.resolve = (root, args, ctx) => {
            const photon = this.params.photon(ctx);

            assertPhotonInContext(photon);

            return photon[mapping.findMany!]
              ['findOne']({ where: { id: root.id } })
              [graphqlField.name](args);
          };
        }

        t.field(fieldName, fieldOpts);

        return result;
      };
      return acc;
    }, {});

    return result;
  }

  isRelationFilterArg(type: string) {
    return (
      type.endsWith('Filter') &&
      ![
        'IntFilter',
        'StringFilter',
        'BooleanFilter',
        'NullableStringFilter',
        'FloatFilter'
      ].includes(type) &&
      type !== 'Filter'
    );
  }

  argTypeName(
    graphQLTypeName: string,
    fieldName: string,
    inputTypeName: string,
    kind: DMMF.FieldKind
  ) {
    if (kind === 'object') {
      const input = this.dmmf.getInputType(inputTypeName);

      if (!input) {
        throw new Error('Could not find input with name: ' + graphQLTypeName);
      }

      if (input.isWhereType) {
        return this.namingStrategy.whereInput(graphQLTypeName, fieldName);
      }

      if (input.isOrderType) {
        return this.namingStrategy.orderByInput(graphQLTypeName, fieldName);
      }

      if (this.isRelationFilterArg(graphQLTypeName)) {
        return this.namingStrategy.relationFilterInput(
          graphQLTypeName,
          fieldName
        );
      }

      return inputTypeName;
    }

    if (kind === 'enum') {
      return inputTypeName;
    }

    return inputTypeName;
  }
}
