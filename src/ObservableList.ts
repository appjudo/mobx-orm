// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action, computed, isObservable, observable, runInAction, IObservableArray } from 'mobx';
import lodash from 'lodash';

export interface List<T> extends Array<T> {
  metadata?: any;
  totalLength?: number;
}

export interface ReloadOptions {
  clear: boolean;
}

export interface PaginatedReloadOptions extends ReloadOptions {
  preload: boolean;
}

type ListProvider<T> = (...args: number[]) => Promise<List<T>>;
type PaginatedListProvider<T> = (pageSize: number, pageIndex?: number) => Promise<List<T>>;

const ObservableArray = observable.array().constructor as {
  new(initialValues: any, enhancer: any, name?: any): IObservableArray;
};

// Adapted from MobX 4.x internals; variable names preserved from original source.
function deepEnhancer(v: any, _: any, name: any) {
  /* eslint-disable */
  // it is an observable already, done
  if (isObservable(v))
    return v;
  // something that can be converted and mutated?
  if (Array.isArray(v))
    return observable.array(v, { name });
  return v;
}

// Used to mask MobX illegal-access errors that occur by combining read/write methods
// from MobX observable object into MobX observable array-object hybrid.
function illegalAccessNoOp() {};

class ObservableArrayObjectHybrid extends ObservableArray {
  constructor() {
    super([], deepEnhancer);
    const _this = this as any;
    const obj: any = observable({});
    _this['$mobx'].read = obj['$mobx'].read;
    _this['$mobx'].write = obj['$mobx'].write;
    _this['$mobx'].illegalAccess = illegalAccessNoOp;
  }
}

export abstract class BaseObservableList<T> extends ObservableArrayObjectHybrid implements List<T> {
  abstract loadingPromise: Promise<List<T>>;
  @observable isLoading: boolean = true;
  @observable isReloading: boolean = false;
  @observable loadedDate?: Date;

  @observable isFullyLoaded: boolean = false;
  @observable fullyLoadedDate?: Date;

  @observable totalLength: number = -1;
  @observable metadata?: any;
  @observable error?: Error;

  protected provider: ListProvider<T>;
  @observable protected versionNumber: number;

  constructor(provider: ListProvider<T>, versionNumber: number = 1) {
    super();
    this.provider = provider;
    this.versionNumber = versionNumber;
  }

  // Deprecated.
  @computed get promise() {
    return this.loadingPromise;
  }

  @action reset() {
    this.replace([], true);
    this.isFullyLoaded = false;
    this.loadedDate = undefined;
    this.fullyLoadedDate = undefined;
    this.error = undefined;
  }

  @action remove(item: T): boolean {
    const result = super.remove(item);
    if (result) this.totalLength--;
    return result;
  }

  @action replace(items: T[], duringReset?: boolean): T[] {
    if (!duringReset) this.totalLength = items.length;
    return super.replace(items);
  }

  @action splice(index: number, count: number = 0, ...items: T[]): T[] {
    this.totalLength = this.totalLength - (count || 0) + items.length;
    return super.splice(index, count, ...items);
  }

  abstract reload(options?: Partial<ReloadOptions>): Promise<List<T> | List<T | undefined>>;
  abstract preload(): Promise<List<T> | List<T | undefined>>;
}

export default class ObservableList<T> extends BaseObservableList<T> {
  loadingPromise: Promise<List<T>>;

  constructor(provider: ListProvider<T>, initialArray?: List<T>) {
    super(provider);
    this.loadingPromise = this.load(initialArray ? Promise.resolve(initialArray) : provider());
  }

  @action reload(options: Partial<ReloadOptions> = {}): Promise<List<T>> {
    const clear = options.clear ?? false;
    if (clear) this.reset();
    if (this.isLoading) return this.loadingPromise;

    this.load(this.provider());
    this.isReloading = true;
    return this.loadingPromise;
  }

  @action preload(): Promise<List<T>> {
    if (this.isLoading) return this.loadingPromise;
    if (!this.loadedDate) return this.reload();
    return Promise.resolve(this.slice());
  }

  @action private load(listPromise: Promise<List<T>>) {
    this.loadingPromise = listPromise.then(action((data: List<T>) => {
      this.isLoading = false;
      this.isReloading = false;
      this.replace(data || []);
      attachMetadata(this, data);
      this.isFullyLoaded = true;
      this.loadedDate = this.fullyLoadedDate = new Date();
      this.totalLength = this.length;
      return data;
    }));
    this.loadingPromise.catch(action((error: Error) => {
      this.reset();
      this.isLoading = false;
      this.isReloading = false;
      this.error = error;
    }));
    this.isLoading = true;
    return this.loadingPromise;
  }
}

interface PageLoadContext {
  cancelled: boolean;
}

export class PaginatedObservableList<T> extends BaseObservableList<T> {
  loadingPromise: Promise<List<T>>;
  provider: PaginatedListProvider<T>;

  readonly pageSize: number;

  private pageLoadContext: PageLoadContext;
  private loadingPageVersionNumbers: (number | undefined)[];
  private pagePromises: (Promise<List<T>> | undefined)[];
  private loadingPageCount: number = 0;

  @observable private itemVersionNumbers: IObservableArray<number | undefined>;
  
  constructor(provider: PaginatedListProvider<T>, pageSize: number, versionNumber: number = 1) {
    super(provider, versionNumber);
    this.provider = provider;
    this.pageSize = pageSize;

    this.itemVersionNumbers = observable.array();
    this.pageLoadContext = {cancelled: false};
    this.pagePromises = [];
    this.loadingPageVersionNumbers = [];

    this.loadingPromise = Promise.resolve([]);
    this.isLoading = false;
    this.isReloading = false;
    this.isFullyLoaded = false;
  }

  @action reset() {
    super.reset();
    this.itemVersionNumbers.replace([]);
    this.cancelPendingPageLoads();
  }

  @action reload(options: Partial<PaginatedReloadOptions> = {}): Promise<List<T | undefined>> {
    const {clear, preload} = options;

    if (clear) this.reset();
    this.versionNumber++;
    this.isReloading = true;

    if (preload) this.getPageAtIndex(0);
    return this.loadingPromise;
  }

  getItemAtIndex(itemIndex: number): T | undefined {
    // Access versionNumber here merely to watch for version changes.
    if (this.versionNumber < 0) return undefined;

    if (this.length <= itemIndex
      || this.itemVersionNumbers.length <= itemIndex
      || !this.itemVersionNumbers[itemIndex]
      || this.itemVersionNumbers[itemIndex]! < this.versionNumber
    ) {
      const pageIndex = this.getPageIndexFromItemIndex(itemIndex);
      this.loadPageAtIndex(pageIndex);
    }

    return this[itemIndex];
  }

  @action preload(): Promise<List<T | undefined>> {
    if (this.totalLength >= 0) return Promise.resolve(this.slice());
    if (this.isLoading) return this.loadingPromise;
    return this.getNextPage();
  }

  @action getNextPage(): Promise<List<T>> {
    if (this.isFullyLoaded) {
      return Promise.resolve(attachMetadata([], this) as List<T>);
    }
    return this.getPageAtIndex(this.getPageIndexFromItemIndex(this.length + 1));
  }

  @action getPageAtIndex(pageIndex: number): Promise<List<T>> {
    // Check whether all items of page range are present and timely.
    const startIndex = pageIndex * this.pageSize;
    let endIndex = startIndex + this.pageSize;
    if (this.totalLength !== -1) {
      endIndex = Math.min(endIndex, this.totalLength);
    }
    if (this.length < endIndex || this.itemVersionNumbers.length < endIndex) {
      return this.loadPageAtIndex(pageIndex);
    }

    const result = [];
    for (let index = startIndex; index < endIndex; index++) {
      if (!this[index]
        || !this.itemVersionNumbers[index]
        || this.itemVersionNumbers[index]! < this.versionNumber
      ) {
        return this.loadPageAtIndex(pageIndex);
      }
      result.push(this[index]);
    }

    // If all present and timely, return them (inside Promise.resolve).
    return Promise.resolve(result);
  }

  getPageIndexFromItemIndex(itemIndex: number) {
    return Math.floor(itemIndex / this.pageSize);
  }

  @action private loadPageAtIndex(pageIndex: number): Promise<List<T>> {
    if (this.loadingPageVersionNumbers.length > pageIndex
      && this.loadingPageVersionNumbers[pageIndex] === this.versionNumber) {
      return this.pagePromises[pageIndex]!;
    }

    this.error = undefined;
  
    // Cache these values here as local constants for reliable usage in nested closure scopes.
    const {pageLoadContext, pageSize} = this;
    const loadedVersionNumber = this.versionNumber;
    const pagePromise = this.provider(pageSize, pageIndex).then(action((data: List<T>) => {
      // If page load has been cancelled, drop out, but return data to page promise watchers.
      if (pageLoadContext.cancelled) return data;

      const startIndex = pageSize * pageIndex;
      if (this.length < startIndex) {
        this.length = startIndex;
      }
      if (this.itemVersionNumbers.length < startIndex) {
        this.itemVersionNumbers.length = startIndex;
      }
      for (let index = 0; index < data.length; index++) {
        this[startIndex + index] = data[index];
        this.itemVersionNumbers[startIndex + index] = loadedVersionNumber;
      }

      attachMetadata(this, data);

      const now = new Date();
      if (!this.loadedDate) {
        this.loadedDate = now;
      }
      this.isFullyLoaded = this.itemVersionNumbers.length >= this.totalLength
        && this.itemVersionNumbers.every(versionNumber => versionNumber === this.versionNumber);
      if (this.isFullyLoaded && !this.fullyLoadedDate) {
        this.fullyLoadedDate = now;
      }

      this.pagePromises[pageIndex] = undefined;
      this.loadingPageCount--;
      this.isLoading = !!this.loadingPageCount;
      if (!this.isLoading) this.isReloading = false;

      return data;
    }));
    pagePromise.catch(action((error: Error) => {
      const latestVersionNumber = this.versionNumber;
      if (loadedVersionNumber === latestVersionNumber) {
        this.loadingPageCount--;
        this.isLoading = !!this.loadingPageCount;
        if (!this.isLoading) this.isReloading = false;
      }
      this.error = error;
    }));

    this.pagePromises[pageIndex] = pagePromise;
    this.loadingPageVersionNumbers[pageIndex] = loadedVersionNumber;
    this.loadingPageCount++;
    this.isLoading = true;

    this.loadingPromise = Promise.all([this.loadingPromise, pagePromise]).then(() => {
      return this;
    });
    this.loadingPromise.catch(() => {});
  
    return pagePromise;
  }

  private cancelPendingPageLoads() {
    this.pageLoadContext.cancelled = true;
    this.pageLoadContext = {cancelled: false};
    this.loadingPromise = Promise.resolve([]);
    this.loadingPageVersionNumbers = [];
    this.loadingPageCount = 0;
  }
}

function attachMetadata<T>(target: List<T> | PaginatedObservableList<T>, source: List<T>) {
  return runInAction(() => {
    if ('metadata' in source) {
      target.metadata = source.metadata;
    }
    if ('totalLength' in source) {
      target.totalLength = source.totalLength;
    }
    return target;
  });
}

export function getObservableListFromArray<T>(sourceArray: List<T> = []): ObservableList<T> {
  return new ObservableList(() => Promise.resolve(sourceArray));
}

export function getPaginatedObservableListFromArray<T>(
  sourceArray: List<T> = [],
  pageSize: number,
): PaginatedObservableList<T> {
  const provider = (pageSize: number, pageIndex: number = 0) => {
    const startIndex = pageIndex * pageSize;
    const result: List<T> = sourceArray.slice(startIndex, pageSize);
    attachMetadata(result, sourceArray);
    return Promise.resolve(result);
  };
  return new PaginatedObservableList(provider, pageSize);
}
