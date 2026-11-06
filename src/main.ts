import "leaflet/dist/leaflet.css";
import "uplot/dist/uPlot.min.css";
import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.body });
