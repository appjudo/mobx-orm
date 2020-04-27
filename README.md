# MobX ORM

An object-relational mapping (ORM) library providing convenient MobX-based abstractions for API resources and other asynchronous data sources.

## Core Ideas

- **Repository Pattern:** mobx-orm uses the Repository design pattern (popular in C# database access) to represent RESTful API resources. Each Repository encapsulates the AJAX mechanics of an API endpoints of a single type of data (e.g. `User`, `Product`, etc.) It then abstracts these concerns into a simple set of [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) methods, *along with a client-side cache of data already fetched from the API.*

- **API Abstraction:** mobx-orm allows client-side API consumers to structure their own models and other abstractions for server-side data. This makes client-side data *much* easier to work with and can streamline the syntax and formatting of data from multiple data sources. (Even multiple APIs from separate organizations.)

- **Client-side Models:** mobx-orm is written in TypeScript, and developers are encouraged to write their own client-side model classes in ES2015+ or TypeScript. The `mobx-orm base Model` class provides useful methods to interact with each model object's source repository and send changes back to the server.

- **Asynchronous Observables:** Each data query immediately returns a MobX observable object or array, (initially empty.) It contains observable properties which indicate when data has been returned and populated into the object/array. These Asynchronous Observables can be used to render React components, checking the `isLoading` property to first render a loading indicator, subsequently showing the loaded data on a second render (triggered automatically by mobx-react's `observer` component wrapper). Each of these Observables also has a `promise` property containing a JavaScript Promise, which can be awaited or chained with `then` or `catch` to perform follow-up actions.

- **Random-access Pagination:** mobx-orm provides a paginated observable array structure allowing any arbitrary page index to be loaded in any order. This can be used for standard pagination or infinite scrolling interfaces, or combined with [react-virtualized](https://github.com/bvaughn/react-virtualized) or [react-window](https://github.com/bvaughn/react-window) for virtual scrolling.

## Roadmap

mobx-orm has been used successfully in production and will continue to evolve.

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
