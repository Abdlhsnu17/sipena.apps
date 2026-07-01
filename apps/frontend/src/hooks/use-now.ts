"use client"

import { useSyncExternalStore } from "react"

type Listener = () => void

let nowSnapshot = new Date()
let intervalId: ReturnType<typeof setInterval> | null = null
const listeners = new Set<Listener>()

function startTimer() {
  if (intervalId) return
  intervalId = setInterval(() => {
    nowSnapshot = new Date()
    listeners.forEach((listener) => listener())
  }, 1000)
}

function stopTimer() {
  if (!intervalId) return
  clearInterval(intervalId)
  intervalId = null
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  if (listeners.size === 1) startTimer()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stopTimer()
  }
}

function getSnapshot() {
  return nowSnapshot
}

function getServerSnapshot() {
  return nowSnapshot
}

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

