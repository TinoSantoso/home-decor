import { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';

interface Props {
  url: string;
  position: [number, number, number];
  scale: [number, number, number];
}

function GLBMesh({ url, position, scale }: Props) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} position={position} scale={scale} />;
}

export function PlacedItemModel(props: Props) {
  return (
    <Suspense fallback={null}>
      <GLBMesh {...props} />
    </Suspense>
  );
}
