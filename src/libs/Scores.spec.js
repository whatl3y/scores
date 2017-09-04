import assert from 'assert'
import Scores from './Scores.js'

describe('Scores', function() {
  const scores = new Scores('ncf')

  describe('#get() and #parseFinalGames()', function() {
    let response
    it(`should make a request to bottomline endpoint to get games`, async () => {
      response = await scores.get()
      assert.equal(true, typeof response === 'string')
    })

    it(`should parse the events and return any potential final games`, () => {
      const events = scores.parseFinalGames(response)
      assert.equal(true, events instanceof Array)
    })
  })

  describe('#getAllFinalGames()', function() {
    it(`should get all final games and parse them into a readable object`, async function() {
      this.timeout(10000)
      const allEvents = await scores.getAllFinalGames()
      const firstSport = allEvents[0]
      const arrayOfFirstSportEvents = firstSport[Object.keys(firstSport)[0]]

      assert.equal(true, allEvents instanceof Array)
      assert.equal(true, typeof firstSport === 'object')
      assert.equal(true, arrayOfFirstSportEvents instanceof Array)
    })
  })
})
