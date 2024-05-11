<script lang="ts">
  import Disassembler from './disassembler.js'
  import Bundle from '../../../protect/bundle.json'

  const disassembler = new Disassembler(Bundle.bytecode, Bundle.strings)
  disassembler.start()

</script>

<main>
    <!--    <h1>Hello {name}!</h1>-->
    <!--    <input bind:value={name} placeholder="Enter your name">-->
</main>

<style>
    main {
        text-align: center;
        padding: 1em;
        max-width: 240px;
        margin: 0 auto;
    }

    h1 {
        color: #333;
    }

    input {
        width: 100%;
        padding: 0.5em;
        margin: 0.5em 0;
        color: #333;
        background-color: #eee;
        border: none;
        border-radius: 2px;
    }
</style>
