import React from 'react';
import { Composition } from 'remotion';
import { DURACION, Matala } from './Matala.jsx';

export function Root() {
  return (
    <Composition
      id="Matala"
      component={Matala}
      durationInFrames={Math.ceil(DURACION * 30)}
      fps={30}
      width={1080}
      height={1080}
    />
  );
}
