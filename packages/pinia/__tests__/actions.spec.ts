import { createPinia, defineStore, setActivePinia } from '../src'

describe('Actions', () => {
  const useStore = () => {
    // create a new store
    setActivePinia(createPinia())
    return defineStore({
      id: 'main',
      state: () => ({
        a: true,
        nested: {
          foo: 'foo',
          a: { b: 'string' },
        },
      }),
      getters: {
        nonA(): boolean {
          return !this.a
        },
        otherComputed() {
          return this.nonA
        },
      },
      actions: {
        async getNonA() {
          return this.nonA
        },
        simple() {
          this.toggle()
          return 'simple'
        },

        toggle() {
          return (this.a = !this.a)
        },

        setFoo(foo: string) {
          this.$patch({ nested: { foo } })
        },

        combined() {
          this.toggle()
          this.setFoo('bar')
        },

        throws() {
          throw new Error('fail')
        },

        async rejects() {
          throw 'fail'
        },
      },
    })()
  }

  const useB = defineStore({
    id: 'B',
    state: () => ({ b: 'b' }),
  })

  const useA = defineStore({
    id: 'A',
    state: () => ({ a: 'a' }),
    actions: {
      swap() {
        const bStore = useB()
        const b = bStore.$state.b
        bStore.$state.b = this.$state.a
        this.$state.a = b
      },
    },
  })

  it('can use the store as this', () => {
    const store = useStore()
    expect(store.$state.a).toBe(true)
    store.toggle()
    expect(store.$state.a).toBe(false)
  })

  it('store is forced as the context', () => {
    const store = useStore()
    expect(store.$state.a).toBe(true)
    expect(() => {
      store.toggle.call(null)
    }).not.toThrow()
    expect(store.$state.a).toBe(false)
  })

  it('can call other actions', () => {
    const store = useStore()
    expect(store.$state.a).toBe(true)
    expect(store.$state.nested.foo).toBe('foo')
    store.combined()
    expect(store.$state.a).toBe(false)
    expect(store.$state.nested.foo).toBe('bar')
  })

  it('supports being called between two applications', () => {
    const pinia1 = createPinia()
    const pinia2 = createPinia()
    setActivePinia(pinia1)
    const aStore = useA()

    // simulate a different application
    setActivePinia(pinia2)
    const bStore = useB()
    bStore.$state.b = 'c'

    aStore.swap()
    expect(aStore.$state.a).toBe('b')
    // a different instance of b store was used
    expect(bStore.$state.b).toBe('c')
  })

  it('can force the pinia', () => {
    // setup other pinias to force possible override effects on the options effect
    const pinia11 = createPinia()
    // const pinia22 = createPinia()
    setActivePinia(pinia11)
    useA()
    setActivePinia(undefined)

    const pinia1 = createPinia()
    const pinia2 = createPinia()
    const aStore = useA(pinia1)

    let bStore = useB(pinia2)
    bStore.$state.b = 'c'

    aStore.swap()
    expect(aStore.$state.a).toBe('b')
    // a different instance of b store was used
    expect(bStore.$state.b).toBe('c')
    bStore = useB(pinia1)
    expect(bStore.$state.b).toBe('a')
  })

  it('throws errors', () => {
    const store = useStore()
    expect(() => store.throws()).toThrowError('fail')
  })

  it('throws errors', () => {
    const store = useStore()
    expect(() => store.throws()).toThrowError('fail')
  })

  it.skip('can avoid thrown errors to propagate', () => {
    const store = useStore()
    store.$onAction(({ onError }) => {
      onError(() => false)
    })
    expect(() => store.throws()).not.toThrowError('fail')
  })

  it.skip('can avoid async errors to propagate', async () => {
    const store = useStore()
    store.$onAction(({ onError }) => {
      onError(() => false)
    })
    await expect(store.rejects()).resolves.toBe(undefined)
  })

  it('throws async errors', async () => {
    const store = useStore()
    expect.assertions(1)
    await expect(store.rejects()).rejects.toBe('fail')
  })

  it('can catch async errors', async () => {
    const store = useStore()
    expect.assertions(3)
    const spy = jest.fn()
    await expect(store.rejects().catch(spy)).resolves.toBe(undefined)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('fail')
  })

  it.skip('can override the returned value', () => {
    const store = useStore()
    expect.assertions(2)
    store.$onAction(({ after }) => {
      // @ts-expect-error: cannot return a string because no action returns a string
      after((v) => {
        expect(v).toBe(false)
        return 'hello'
      })
    })
    expect(store.toggle()).toBe('hello')
  })

  it.skip('can override the resolved value', async () => {
    const store = useStore()
    expect.assertions(2)
    store.$onAction(({ after }) => {
      // @ts-expect-error: cannot return a string because no action returns a string
      after((v) => {
        expect(v).toBe(false)
        return 'hello'
      })
    })
    await expect(store.getNonA()).resolves.toBe('hello')
  })

  it.skip('can override the resolved value with a promise', async () => {
    const store = useStore()
    expect.assertions(2)
    store.$onAction(({ after }) => {
      // @ts-expect-error: cannot return a string because no action returns a string
      after(async (v) => {
        expect(v).toBe(false)
        return 'hello'
      })
    })
    await expect(store.getNonA()).resolves.toBe('hello')
  })

  it('can destructure actions', () => {
    const store = useStore()
    const { simple } = store
    expect(simple()).toBe('simple')
    // works with the wrong this
    expect({ simple }.simple()).toBe('simple')
    // special this check
    expect({ $id: 'o', simple }.simple()).toBe('simple')
    // override the function like devtools do
    expect(
      {
        $id: store.$id,
        simple,
        // otherwise it would faial
        toggle() {},
      }.simple()
    ).toBe('simple')
  })
})
