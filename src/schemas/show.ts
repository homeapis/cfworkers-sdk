interface D1TVShow {
  title: string;
  description: string;
}

/**
 * JSON Example
 */
export const exampleShow = {
  id: '12345',
  type: 'tvShow',
  attributes: {
    title: 'The Mandalorian',
    description:
      'A lone Mandalorian bounty hunter travels the outer reaches of the galaxy, far from the authority of the New Republic.',
    release_year: 2019,
    runtime: 50, // Runtime in minutes per episode
    seasons: 2,
    genres: ['Action', 'Adventure', 'Sci-Fi', 'Western'],
    poster_image: {
      url: 'https://s3.disneyplus.com/posters/the_mandalorian.jpg',
      width: 1000,
      height: 1500
    },
    maturity_rating: 'TV-PG',
    is_original: true, // Indicates if it's a Disney+ Original
    cast: [
      {
        id: 5678,
        name: 'Pedro Pascal'
      }
      // ... other cast members
    ],
    crew: [
      {
        id: 8901,
        name: 'Jon Favreau',
        role: 'Creator'
      }
      // ... other crew members
    ]
  },
  links: {
    self: '/api/v1/shows/12345',
    seasons: '/api/v1/shows/12345/seasons'
  }
};

export type { D1TVShow };
