# Photogen

Auto-generated CRUD & model resolvers for GraphQL Nexus using Prisma Photon

## Getting started

#### 1. Clone the repo

Clone this repository:

```
git clone https://github.com/Weakky/photogen.git
cd photogen/example
```

#### 2. Install the Prisma 2 CLI

```bash
npm install -g prisma2
```

You can now use the Prisma 2 CLI using the `prisma2` command.

#### 3. Install dependencies

Install Node depencies:

```
npm install
```

> Note that the Photon & Photogen generation are included in an [`install`](./example/package.json#L6) script in your [`package.json`](./example/package.json), which means Photon also gets (re-)generated upon each `npm install`.

#### 4. Migrate the database

With Prisma 2, database migrations are performed using the `lift` subcommand of the Prisma CLI, i.e. `prisma2 lift <command>`.

##### 4.1. Create migration

Run the following command to create a new migration:

```
prisma2 lift create --name 'init'
```

This creates a new directory called `migrations`. This directory stores detailed info about each migration you perform throughout the lifetime of your project.

Every migration is represented via its own directory inside the `migrations` directory. In this case, your first migration is called `TIMESTAMP-init` (e.g. `20190605165416-init`). It contains tree files:

- `datamodel.prisma`: The target datamodel for the migration.
- `steps.json`: A summary of all the required steps to perform the migration.
- `README.md`: A markdown file highlighting important information about the migration (e.g. a diff of the datamodel or the performed SQL statements).

##### 4.2. Execute migration

To actually execute the migration against your database, run:

```
prisma2 lift up
```

This applies the steps specified in `steps.json` and therefore migrates the database schema to match the datamodel.

#### 5. Run the GraphQL Server

Run the following command to run the GraphQL Server:

```
npm start
```

#### 6. Known limitations

1. `update` doesn't work because of a query engine limitation
