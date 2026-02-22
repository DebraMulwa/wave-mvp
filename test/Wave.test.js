const Wave =artifacts.require('./Wave.sol')

contract('Wave',(accounts)=>{
    before(async ()=>{
        this.wave =await Wave.deployed()
    })
    it('deploys successfully',async()=>{
        const address =await this.wave.address
        assert.notEqual(address,0x0)
        assert.notEqual(address,'')
        assert.notEqual(address,null)
        assert.notEqual(address,undefined)
    })
    it('lists tasks ', async () => {
  const taskCount = await this.wave.taskCount()
  const task = await this.wave.tasks(taskCount)

  assert.equal(task.id.toNumber(), taskCount.toNumber())
  assert.equal(task.content, "Film content for campaign") 
  assert.equal(task.completed, false)
  assert.equal(taskCount.toNumber(), 1)
})
 it('creates tasks ', async () => {
  const result = await this.wave.createTask('A new task')
  const taskCount = await this.wave.taskCount()
  assert.equal(taskCount,(2))
  console.log(result)
  const event =result.logs[0].args
  assert.equal(event.id.toNumber(),2)
  assert.equal(event.content,'A new task')
  assert.equal(event.completed,false)
})


it('toggles task completion', async () => {
  const result = await this.wave.toggleCompleted(1)
  const task = await this.wave.tasks(1)
  assert.equal(task.completed,true)
  console.log(result)
  const event =result.logs[0].args
  assert.equal(event.id.toNumber(),1)
  assert.equal(event.completed,true)
})
})