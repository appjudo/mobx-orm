// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action, computed, observable } from 'mobx';

import Repository from './Repository';
import { Id, ModelObject } from './types';

interface UpdateOptions<T extends Model<T>> {
  repository?: Repository<T>;
}

export default abstract class Model<T extends Model<T>> {
  @observable id?: Id;
  @observable _isLoading: boolean = false;
  @observable _promise?: Promise<T | undefined>;
  @observable repository?: Repository<T>;

  /* eslint-disable-next-line class-methods-use-this */
  get isFullyLoaded(): boolean {
    return true;
  }

  @action update(values: Partial<T> = {}, options: UpdateOptions<T>) {
    const repository = options.repository || this.repository;
    if (!repository) {
      throw new Error('Model `update` method called without repository');
    }
    const itemId = this[repository.idKey as keyof this] as unknown as Id;
    if (!itemId) {
      throw new Error(`Model \`update\` requires \`${repository.idKey}\` to be present`);
    }
    const result = repository.update(values);
    Object.assign(this, values);
    return result;
  }

  @action save(repository?: Repository<T>) {
    if (!repository) repository = this.repository;
    if (!repository) {
      throw new Error('Model `save` method called without repository');
    }
    const itemId = this[repository.idKey as keyof this] as unknown as Id;
    return repository[itemId ? 'update' : 'add'](this as unknown as T);
  }

  @action reload(repository?: Repository<T>) {
    if (!repository) repository = this.repository;
    if (!repository) {
      throw new Error('Model `reload` method called without repository');
    }
    return repository.reload(this as unknown as T);
  }
}
