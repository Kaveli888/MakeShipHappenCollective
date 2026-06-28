import React from 'react';
import {Composition} from 'remotion';
import {Promo, PROMO_DURATION, PROMO_FPS} from './Promo';

export const Root: React.FC = () => {
	return (
		<>
			<Composition
				id="ShipSpacePromo"
				component={Promo}
				durationInFrames={PROMO_DURATION}
				fps={PROMO_FPS}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ShipSpacePromoVertical"
				component={Promo}
				durationInFrames={PROMO_DURATION}
				fps={PROMO_FPS}
				width={1080}
				height={1920}
			/>
		</>
	);
};
