# MobX ORM

An object-relational mapping (ORM) library providing convenient MobX-based abstractions for API resources and other asynchronous data sources.

## Core Ideas

**Repository pattern:** mobx-orm uses the Repository design pattern (popular in C# database access) to represent RESTful API resources. Each repository encapsulates the AJAX mechanics of a related API endpoints of single type of data (e.g. `User`, `Product`, etc.) and abstracts these concerns into a simple set of [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) methods, along with a client-side cache of data already fetched and returned from the API server.

**Asynchronous observables:** Each data query immediately returns a MobX observable object or array, initially empty, with observable properties to indicate when the data requested has been returned from the API server (or other data source) and populated into the object/array. These asynchronous observables can be used immediately to render React components, checking the `isLoading` property to first render a loading indicator, and then show the loaded data on the second render (triggered automatically by mobx-react's `observer` component wrapper). Each of these observables also has a `promise` property containing a JavaScript Promise, which can be awaited or chained with `then` or `catch` to perform follow-up actions.

**Random-access pagination:** mobx-orm provides a paginated observable array structure allowing any arbitrary page index to be loaded in any order. This can be used out of the box for standard pagination or infinite  scrolling interfaces, or combined with [react-virtualized](https://github.com/bvaughn/react-virtualized) or [react-window](https://github.com/bvaughn/react-window) for virtual scrolling.

**Client-side models:** mobx-orm is written in TypeScript, and developers are encouraged to write their own client-side model classes in ES2015+ or TypeScript. The base `Model` class provides useful methods to interact with each model object's source repository and send changes back to the server.

**API abstraction:** mobx-orm allows API consumers to structure their own client-side models and other abstractions for server-side data, which can make data much easier to work with on the client side, and can also streamline the syntax and formatting of data from multiple disparate data sources, such as different versions of an evolving API or multiple APIs published by separate organizations.

## Roadmap

* Documentation
* Automated tests
* Support for MobX 5
* Relationship decorators
* Service abstractions
* Snapshots

## Contributing

Please see our [guide to contributing](./CONTRIBUTING.md).

## License

mobx-orm is licensed under the [MIT License](./LICENSE).

*Copyright &copy; 2017-2020 AppJudo Inc. and its affiliates.*
