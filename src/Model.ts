// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action, computed, observable } from 'mobx';

import Repository from './Repository';
import { Id, ModelObject, Context } from './types';

class ModelOrmData<T extends Model<T>> {
  @observable isLoading: boolean = false;
  @observable isReloading: boolean = false;
  @observable loadingPromise?: Promise<T | undefined>;

  @observable isSaving: boolean = false;
  @observable savingPromise?: Promise<T | undefined>;

  @observable repository?: Repository<T>;

  // Deprecated.
  @computed get promise() {
    return this.loadingPromise;
  }
}

export default abstract class Model<T extends Model<T>> {
  @observable id?: Id;
  @observable _orm: ModelOrmData<T>;

  constructor() {
    this._orm = new ModelOrmData();
  }

  /* eslint-disable-next-line class-methods-use-this */
  get isFullyLoaded(): boolean {
    return true;
  }

  @action update(values: Partial<T> = {}, context: Context<T> = {}) {
    const repository = context.repository || this._orm.repository;
    if (!repository) {
      throw new Error('Model `update` method called without repository');
    }
    const item = this as unknown as T;
    const itemId = item[repository.idKey];
    if (!itemId) {
      throw new Error(`Model \`update\` requires \`${repository.idKey}\` to be already set`);
    }
    return repository.update(item, values, context);
  }

  @action save(context: Context<T> = {}) {
    const repository = context.repository || this._orm.repository;
    if (!repository) {
      throw new Error('Model `save` method called without repository');
    }
    const {idKey} = repository;
    const item = this as unknown as T;
    const itemId = item[idKey];
    return itemId
      ? repository.update(item, undefined, context)
      : repository.add(item, context);
  }

  @action reload(context: Context<T> = {}) {
    const repository = context.repository || this._orm.repository;
    if (!repository) {
      throw new Error('Model `reload` method called without repository');
    }
    return repository.reload(this as unknown as T, context);
  }
}
