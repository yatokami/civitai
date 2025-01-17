import { Center, Container, Group, Loader, Stack } from '@mantine/core';
import { useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';

import { GalleryPeriod, GallerySort, useGalleryFilters } from '~/components/Gallery/GalleryFilters';
import { InfiniteGalleryGrid } from '~/components/Gallery/InfiniteGalleryGrid';
import { useFeatureFlags } from '~/providers/FeatureFlagsProvider';
import { trpc } from '~/utils/trpc';

export default function Gallery() {
  const filters = useGalleryFilters();
  const { ref, inView } = useInView();
  const { gallery } = useFeatureFlags();

  const { data, isLoading, fetchNextPage, hasNextPage } =
    trpc.image.getGalleryImagesInfinite.useInfiniteQuery(filters, {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
  const images = useMemo(
    () => data?.pages.flatMap((x) => (!!x ? x.items : [])) ?? [],
    [data?.pages]
  );

  useEffect(() => {
    if (inView) {
      fetchNextPage();
    }
  }, [fetchNextPage, inView]);

  if (!gallery) return null;

  return (
    <Container size={1920}>
      {isLoading ? (
        <Center py="xl">
          <Loader size="xl" />
        </Center>
      ) : (
        <Stack>
          <Group position="apart">
            <GallerySort />
            <GalleryPeriod />
          </Group>
          <InfiniteGalleryGrid data={images} filters={filters} columnWidth={300} />
        </Stack>
      )}
      {!isLoading && hasNextPage && (
        <Group position="center" ref={ref}>
          <Loader />
        </Group>
      )}
    </Container>
  );
}
