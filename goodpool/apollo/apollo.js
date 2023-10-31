import { ApolloClient, InMemoryCache, HttpLink, gql, useQuery } from '@apollo/client';

const httpLink = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswapv2',
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

export default client;

const GET_MATIC_DERIVED = gql`
  query {
    pair (id: "0x819f3450da6f110ba6ea52195b3beafa246062de") {
      id
      token0 {
        id
        symbol
        name
        derivedETH
      }
    }
  }
`;

export const useDerived = () => {
	const { error, loading, data } = useQuery(GET_MATIC_DERIVED);

	return {
			error,
			loading,
			data,
	}
}