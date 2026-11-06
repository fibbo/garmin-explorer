<script lang="ts">
  import { ICON_PATHS, sportColor } from "./sports";
  import type { SportKey } from "./types";

  let { sport }: { sport: SportKey } = $props();
</script>

<span class="badge" style:background={sportColor(sport)}
  ><svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round">{@html ICON_PATHS[sport]}</svg
  ></span
>
