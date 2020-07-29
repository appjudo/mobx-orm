// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

/* eslint-disable class-methods-use-this */

import { action } from 'mobx';
import { CollectionOptions, Context, List, ModelObject, ObservableList } from './types';
import Model from './Model';


export interface RepositoryContext<T extends Model<any>> extends Context<T> {
  repository: Repository<T>;
}

export type RepositoryContextBuilder<T extends Model<any>> =
  RepositoryContext<T> | ((repository: Repository<T>) => any);

export default abstract class Repository<T extends Model<any>> {
  idKey: keyof T = 'id';

  context?: RepositoryContextBuilder<T>;

  abstract async list(options?: CollectionOptions<T>, pageIndex?: number): Promise<List<T>>;
  abstract async getById(id: string, reload: boolean, context?: Context<T>): Promise<T | undefined>;
  abstract async add(item: T, context?: Context<T>): Promise<T | undefined>;
  abstract async update(item: Partial<T>, context?: Context<T>): Promise<T | undefined>;
  abstract async delete(item: T, context?: Context<T>): Promise<any>;
  abstract async deleteAll(options?: CollectionOptions<T>): Promise<List<T>>;
  abstract async reload(item: T, context?: Context<T>): Promise<T | undefined>;

  @action listObservable(options?: CollectionOptions<T>): ObservableList<T> {
    return new ObservableList(() => this.list(options));
  }
}

export class EmptyRepository<T extends Model<any>> extends Repository<T> {
  @action async list(): Promise<List<T>> {
    return [];
  }

  @action async getById(): Promise<T | undefined> {
    return undefined;
  }

  @action async add(): Promise<T> {
    throw new Error("Can't add items to EmptyRepository");
  }

  @action async update(): Promise<T> {
    throw new Error("Can't update items in EmptyRepository");
  }

  /* eslint-disable-next-line no-empty-function */
  @action async delete(): Promise<any> {}

  /* eslint-disable-next-line no-empty-function */
  @action async deleteAll(): Promise<any> {}

  @action async reload(item: T): Promise<T | undefined> {
    return item;
  }
}
