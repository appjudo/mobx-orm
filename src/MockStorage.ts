// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { LocalStorage } from './types';

export default class MockStorage implements LocalStorage {
  private items: Record<string, string>;

  constructor() {
    this.items = {};
  }

  getItem(key: string) {
    return this.items[key];
  }

  setItem(key: string, value: string) {
    this.items[key] = value;
    return value;
  }

  removeItem(key: string) {
    delete this.items[key];
  }

  clear() {
    this.items = {};
  }
}
