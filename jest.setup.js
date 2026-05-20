'use strict'

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterAll(() => {
  jest.restoreAllMocks()
})
